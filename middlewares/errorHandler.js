// middlewares/errorHandler.js

function errorHandler(err, req, res, next) {
    // Log the error internally
    console.error(err);

    // Respond with a generic error message
    res.status(500).send('Something went wrong!');
}

module.exports = errorHandler;
