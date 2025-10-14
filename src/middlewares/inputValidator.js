import Joi from "joi";

const userSchema = Joi.object({
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required(),
  username: Joi.string().alphanum().min(3).max(50).required(),
  phone_number: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .message("Phone number must be between 10–15 digits")
    .optional(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(64).required(),
});

const validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body, { abortEarly: true });
  if (error) {
    return res.status(400).json({
      status: 400,
      message: error.details[0].message,
    });
  }
  next();
};

export default validateUser;
