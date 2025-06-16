const mongoose = require('mongoose');
// const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://uwamarigoddey:yuVVSvbXvTnwvhuh@cluster0.n4uflq6.mongodb.net/Backend%20Project?retryWrites=true&w=majority';
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://uwamarigoddey:yuVVSvbXvTnwvhuh@cluster0.n4uflq6.mongodb.net/Backend_Project?retryWrites=true&w=majority';

const connectDB = async () => {
  try {
    await mongoose.connect(mongoUrl, {
      // useCreateIndex: true,
      // useFindAndModify: false,
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    console.log('Mongodb connection established');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};
module.exports = connectDB;
