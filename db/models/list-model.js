const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minlength: 1,
        trim: true
    },
    //with auth
    _userId: {
        type: mongoose.Types.ObjectId,
        required: true
    }
})

const list = mongoose.model('List', listSchema);

module.exports = { list }