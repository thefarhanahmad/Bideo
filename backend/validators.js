const { body, validationResult } = require('express-validator');

const videoValidationRules = () => [
  body('title').optional().isLength({ max: 200 }),
  body('description').optional().isLength({ max: 2000 }),
  body('category').optional().isString(),
  body('owner').optional().isString(),
  body('isPinned').optional(),
];


const commentValidationRules = () => [
  body('text').notEmpty().withMessage('Comment text is required').isLength({ max: 1000 }),
];

const authValidationRules = () => [
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').optional().isString(),
  body('avatar').optional().isString(),
];

const cleanPhone = (val) => {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

const phoneSignupValidationRules = () => [
  body('name').trim().notEmpty().withMessage('Name is required').isString(),
  body('phone')
    .customSanitizer(cleanPhone)
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Phone number must be a valid 10-digit number'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const phoneLoginValidationRules = () => [
  body('phone')
    .customSanitizer(cleanPhone)
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Phone number must be a valid 10-digit number'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errArray = errors.array();
    const firstError = errArray[0];
    const message = firstError?.msg || firstError?.message || 'Invalid input data';
    return res.status(400).json({
      success: false,
      message,
      errors: errArray,
    });
  }
  next();
};

module.exports = {
  cleanPhone,
  videoValidationRules,
  commentValidationRules,
  authValidationRules,
  phoneSignupValidationRules,
  phoneLoginValidationRules,
  validate,
};

