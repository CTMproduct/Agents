const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
      console.warn('⚠️  MONGODB_URI no configurada - Usando almacenamiento en memoria');
      return false;
    }

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB conectado exitosamente');
    console.log(`📍 Base de datos: ${mongoose.connection.name}`);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.warn('⚠️  Continuando con almacenamiento en memoria...');
    return false;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB desconectado');
  } catch (error) {
    console.error('❌ Error desconectando MongoDB:', error.message);
  }
};

const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDB,
  disconnectDB,
  isConnected,
  mongoose,
};
