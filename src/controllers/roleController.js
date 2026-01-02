import Role from "../models/role.js";

export const createRole = async (req, res) => {
  const { roleName, status, permissions } = req.body;

  const exists = await Role.findOne({ roleName });
  if (exists) return res.status(400).json({ message: "Role exists" });

  const role = await Role.create({
    roleName,
    status,
    permissions,
    history: [
      {
        action: "CREATED",
        performedBy: req.employee._id,
      },
    ],
  });

  res.status(201).json(role);
};

export const getAllRoles = async (req, res) => {
  const roles = await Role.find().select("roleName status");
  res.json(roles);
};

export const getRoleById = async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  res.json(role);
};

export const updateRole = async (req, res) => {
  const { permissions, status } = req.body;

  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });

  role.permissions = permissions;
  role.status = status;

  role.history.push({
    action: "UPDATED",
    performedBy: req.employee._id,
  });

  await role.save();
  res.json(role);
};

export const getRoleHistory = async (req, res) => {
  const role = await Role.findById(req.params.id).populate(
    "history.performedBy",
    "firstName lastName email"
  );

  if (!role) return res.status(404).json({ message: "Role not found" });
  res.json(role.history);
};
