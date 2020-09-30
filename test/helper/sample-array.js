const Joi = require('joi-strict');

module.exports = (...args) => {
  Joi.assert(args, Joi.array().ordered(
    Joi.array().min(1),
    Joi.number().integer().min(0),
    Joi.object().keys({
      rng: Joi.function().optional(),
      unique: Joi.boolean().optional()
    }).optional()
  ));
  const [arr, len, { rng = Math.random, unique = false } = {}] = args;

  const available = [];
  const result = [];
  while (result.length < len) {
    if (available.length === 0) {
      available.push(...Array(arr.length).keys());
    }
    const index = Math.floor(rng() * available.length);
    const picked = unique ? available.splice(index, 1)[0] : available[index];
    const char = arr[picked];
    result.push(char);
  }
  return result;
};
