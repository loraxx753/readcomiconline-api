const unknown = (res, error) => {
  const response = {
    error: 'UNKNOWN',
    message: error.message,
    backtrace: error.stack.split("\n")
  };

  res.status(401).json(response);
}

export { unknown };
