// This file will handle connection logic to MongoDB

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

mongoose.set('strictQuery', false);

mongoose.connect('mongodb+srv://saitejagoruganthu118:R4QOcv9kcKaLa2uR@cluster0.aspy97j.mongodb.net/taskmanager?retryWrites=true&w=majority')
    .then(()=>{
        console.log("Connected to MongoDB successfully");
    })
    .catch((err)=>{
        console.log("Error while attempting to connect to Mongodb");
        console.log(err);
    });

//To prevent deprecation warnings
//mongoose.set('useCreateIndex', true);
//mongoose.set('usefindAndModify', false);

module.exports = [
    mongoose
]