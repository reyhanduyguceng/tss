require('dotenv').config();

module.exports = {
    THRESHOLD: 2,
    TOTAL_PARTICIPANTS: 3,
    CHAIN_ID: process.env.CHAIN_ID || '1',
    NODE_URLS: {
        1: process.env.NODE_1_URL || 'http://localhost:8545',
        2: process.env.NODE_2_URL || 'http://localhost:8546',
        3: process.env.NODE_3_URL || 'http://localhost:8547'
    }
};