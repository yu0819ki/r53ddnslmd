const logger = (() => {
  try {
    // eslint-disable-next-line
    return require('winston-color');
  } catch (err) {
    return false;
  }
})() || console;

module.exports = logger;
