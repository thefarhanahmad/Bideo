const Category = require('../models/Category');

// @desc Get all categories
// @route GET /api/categories
// @access Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().lean();
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (err) {
    next(err);
  }
};

// @desc Create category
// @route POST /api/categories
// @access Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    const name = req.body.name;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const existing = await Category.findOne({ slug });
    if (existing) return res.status(400).json({ success: false, message: 'Category already exists' });

    const category = await Category.create({ name, slug });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

// @desc Update category
// @route PUT /api/categories/:id
// @access Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const name = req.body.name || category.name;
    category.name = name;
    category.slug = name.toLowerCase().replace(/\s+/g, '-');
    await category.save();

    res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

// @desc Delete category
// @route DELETE /api/categories/:id
// @access Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await category.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
