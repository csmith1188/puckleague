const express = require('express');
const textData = require('../data/textData');

const router = express.Router();

router.get('/', (req, res) => {
    res.render('home', {
        title: 'Home',
        introduction: textData.Introduction,
        changelog: textData.changelog
    });
});

module.exports = router;
