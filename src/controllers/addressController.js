import Address from "../models/address.js";
import User from "../models/user.js";
import responseHandler from "../utils/responseHandler.js";

// Get all addresses
export const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id });

    if (!addresses || addresses.length === 0) {
      return res.status(404).json(responseHandler.error("No addresses found"));
    }

    return res.json(responseHandler.success(addresses, "Addresses retrieved successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Add new address
export const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isDefault, location, ...rest } = req.body;

    let geoLocation;
    // Support both 'long' and 'lng' field names
    const longitude = location?.lng ?? location?.long;
    if (location?.lat != null && longitude != null) {
      geoLocation = {
        type: "Point",
        coordinates: [longitude, location.lat] // longitude first
      };
    }

    // Check if user already has addresses
    const addressCount = await Address.countDocuments({ user: userId });

    // If first address, make it default automatically
    let finalIsDefault = addressCount === 0 ? true : Boolean(isDefault);

    // If user wants this address as default, unset previous default
    if (finalIsDefault) {
      await Address.updateMany(
        { user: userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = new Address({
      ...rest,
      user: userId,
      location: geoLocation,
      isDefault: finalIsDefault
    });

    const savedAddress = await newAddress.save();

    await User.findByIdAndUpdate(userId, { $push: { addresses: savedAddress._id } });

    return res
      .status(201)
      .json(responseHandler.success(savedAddress, "Address added successfully"));

  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update address
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { isDefault, location, ...rest } = req.body;

    let updateData = { ...rest };
    // Support both 'long' and 'lng' field names
    const longitude = location?.lng ?? location?.long;
    if (location?.lat != null && longitude != null) {
      updateData.location = {
        type: "Point",
        coordinates: [longitude, location.lat]
      };
    }

    // If user wants to make this address default
    if (isDefault) {
      await Address.updateMany(
        { user: req.user.id, isDefault: true },
        { $set: { isDefault: false } }
      );
      updateData.isDefault = true;
    }

    const updated = await Address.findOneAndUpdate(
      { _id: id, user: req.user.id },
      updateData,
      { new: true }
    );

    if (!updated)
      return res.status(404).json(responseHandler.error("Address not found"));

    return res.json(responseHandler.success(updated, "Address updated successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Delete address
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Address.findOneAndDelete({ _id: id, user: req.user.id });
    if (!deleted)
      return res.status(404).json(responseHandler.error("Address not found"));

    await User.findByIdAndUpdate(req.user.id, { $pull: { addresses: id } });

    // If deleted address was default, assign another address as default
    if (deleted.isDefault) {
      const anotherAddress = await Address.findOne({ user: req.user.id });
      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
      }
    }

    return res.json(responseHandler.success(null, "Address deleted successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
