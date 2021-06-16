var mongoose = require( 'mongoose' );

//subdocument
var cpcdocSchema = new mongoose.Schema({
    title: {type: String, required: true},
    datetime: {type: Date, required: true},
    caption: {type: Array, required: true},
    lpar: {type: Array, required: true}
});

module.exports.cpcdocs = mongoose.model('CPCActivity', cpcdocSchema);