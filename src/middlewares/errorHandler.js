//  Centralised error hanlding
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    const status = err.statuscode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({
        status: status,
        message: "Something went wrong.",
        error: message,
    })
}

export default errorHandler;