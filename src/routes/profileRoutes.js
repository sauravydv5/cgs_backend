import express from 'express';
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import { getProfile, updateProfile, updateAdminProfile, getAdminProfile } from '../controllers/profileController.js';
import { updateProfileValidation } from '../validators/user.validation.js';
import requestValidator from '../middleware/requestValidator.js';
import { upload } from '../middleware/uploadMiddleware.js';


const router = express.Router();
router.get('/', protect, getProfile);

router.put('/', protect, updateProfileValidation, requestValidator, updateProfile);
router.put('/admin', protect, adminOnly, upload.single('profilePic'), updateProfileValidation, requestValidator, updateAdminProfile);

router.get('/admin', protect, adminOnly, getAdminProfile);
export default router;