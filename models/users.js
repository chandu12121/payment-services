const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const userSchema= new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    dateOfBirth : {type: Date, required: true},
    address: {type: String, required: true},
    password: {type:String, required: true, minlength: 8}
    
},
{ timestamps: true }
)


// 🔐 This pre-save hook automatically hashes the password before saving the user.
// No need to manually hash passwords when creating or updating users.
// It keeps user passwords secure in the database.

userSchema.pre("save", async function(next){
    if (!this.isModified("password")) return next()
        try{
        this.password= await bcrypt.hash(this.password, 10)
        next()
    }catch(e){
        next(e)
    }
})

const userModel= mongoose.model("User", userSchema)
module.exports = userModel

