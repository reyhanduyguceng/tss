const crypto = require('crypto');
const BN = require('bn.js');

exports.generateRandomNumber = () => {
    return new BN(crypto.randomBytes(32));
};

exports.hashMessage = (message) => {
    return crypto.createHash('sha256').update(message).digest('hex');
};