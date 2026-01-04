const express = require("express")
const router= express.Router()
const {
    registerUser,
    loginUser,
    updateUser,
    deleteUser,
    getUser,
    getAllUsers
} = require("../controllers/users")

const authenticate = require("../../../OneDrive/Desktop/My-Projects/payment-gateway-services/middleware/authenticate")

// Public Routes
router.post("/register", registerUser)
router.post("/login",  loginUser)
router.delete("/:id", deleteUser)

// Protected Routes
router.get("/", getAllUsers)
router.get("/user", authenticate, getUser)
router.put("/:id", authenticate, updateUser)

module.exports= router