const { default: mongoose } = require("mongoose");
const User = require("../models/users");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Create new user
const registerUser = async (req, res) => {
    const { name, email, dateOfBirth, address, password } = req.body;
    console.log("req.body", req.body)
    if (!name || !email || !dateOfBirth || !address || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists with this email" });
        }
        const newUser = new User({
            name,
            email,
            address,
            dateOfBirth,
            password
        });

        const user=await newUser.save();
        return res.status(201).json({ message: "User created successfully" , data: user});
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Login user
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { email: user.email, id: user._id, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.status(200).json({ message: "Login successful", token });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Update user
const updateUser = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (req.body.password) {
            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true }).select("-password");
        return res.status(200).json({ message: "User updated successfully", data: updatedUser });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });

        await User.findByIdAndDelete(id);
        return res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Get single user
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ error: "User not found" });

        return res.status(200).json({ message: "User retrieved successfully", data: user });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        return res.status(200).json({ message: "Users retrieved successfully", data: users });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    updateUser,
    deleteUser,
    getUser,
    getAllUsers
};
