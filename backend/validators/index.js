const { body, validationResult } = require('express-validator');

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.param]: err.msg }));

  return res.status(422).json({
    success: false,
    errors: extractedErrors,
  });
};

exports.authValidationRules = () => {
  return [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please add a valid email'),
    body('avatar').notEmpty().withMessage('Avatar is required'),
  ];
};

exports.videoValidationRules = () => {
  return [
    body('title').notEmpty().withMessage('Title is required').isLength({ max: 100 }),
    body('category').notEmpty().withMessage('Category is required'),
  ];
};

exports.commentValidationRules = () => {
  return [
    body('video').notEmpty().withMessage('Video ID is required'),
    body('text').notEmpty().withMessage('Comment text is required').isLength({ max: 500 }),
  ];
};
