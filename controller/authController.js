const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  };
  res.cookie('jwt', token, cookieOptions);
  // console.log(user);
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    role: req.body.role
  });
  const url = `${req.protocol}://${req.get('host')}/me`;
  new Email(newUser, url).sendWelcome();
  createSendToken(newUser, 201, req, res);
});
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError('please enter email and password', 400));

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  createSendToken(user, 200, req, res);
});
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};
exports.protect = catchAsync(async (req, res, next) => {
  // 1) getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('you are not logged in! please log in to get access', 401)
    );
  }
  //2) verfication if user still exist
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);
  // 3) check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }
  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPassworedAfter(decoded.iat)) {
    return next(
      new AppError('user recently Changed Password! Please logIn again,', 401)
    );
  }
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.isLoggedin = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      //1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      // 2) check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPassworedAfter(decoded.iat)) {
        return next();
      }
      //There is A logged IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // console.log(req);
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1) get user based on posted Email

  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There Is No User With Email Address!', 404));
  }
  //2)generate the random reset token

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //3) send it to user's email

  try {
    const resetURL = `${req.protocol}://${req.get('host')}
      /api/v1/users/resetpassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();
    res.status(200).json({
      status: 'success',
      message: 'token sent to email'
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        `There was an error sending the email. try again later!`,
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
  //2)If Token has not expired, and there is user ,set the new password
  if (!user) return next(new AppError('Token is invalid or has expired', 400));
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  //3)Update changedPasswordAt property for the user
  //4)log the user in , send JWT
  createSendToken(user, 200, req, res);
});
exports.updatePassword = catchAsync(async (req, res, next) => {
  //1) Get the user from collection
  const user = await User.findById(req.user.id).select('+password');
  //2) check if posted current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }
  //3) If So , update passowrd
  user.password = req.body.newPassword;
  user.confirmPassword = req.body.confirmNewPassword;
  await user.save();
  //4)log user in ,send jwt
  createSendToken(user, 200, req, res);
});