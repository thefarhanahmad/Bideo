const { body, validationResult } = require('express-validator');

const videoValidationRules = () => [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional().isLength({ max: 2000 }),
  body('category').optional().isString(),
];


const commentValidationRules = () => [
  body('text').notEmpty().withMessage('Comment text is required').isLength({ max: 1000 }),
];

const authValidationRules = () => [
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').optional().isString(),
  body('avatar').optional().isString(),
];

const phoneSignupValidationRules = () => [
  body('name').notEmpty().withMessage('Name is required').isString(),
  body('phone').notEmpty().withMessage('Phone is required').isLength({ min: 10, max: 10 }).withMessage('Phone must be 10 digits').isNumeric().withMessage('Phone must be numeric'),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }),
];

const phoneLoginValidationRules = () => [
  body('phone').notEmpty().withMessage('Phone is required').isLength({ min: 10, max: 10 }).withMessage('Phone must be 10 digits').isNumeric().withMessage('Phone must be numeric'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { videoValidationRules, commentValidationRules, authValidationRules, phoneSignupValidationRules, phoneLoginValidationRules, validate };

