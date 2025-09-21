/**
 * Role-based Authorization Middleware
 * Handles role-based access control for protected routes
 */

/**
 * Middleware to check if user has required role(s)
 * Must be used after auth middleware that sets req.user
 * @param {...string} roles - Allowed roles for the route
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. Authentication required.'
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 * Shorthand for authorize('admin')
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

/**
 * Middleware to check if user can access resource
 * Allows access if user is admin or resource owner
 * @param {string} resourceUserField - Field name containing user ID in resource
 */
const ownerOrAdmin = (resourceUserField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. Authentication required.'
      });
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.body[resourceUserField] || 
                          req.params.userId || 
                          req.resource?.[resourceUserField];

    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      message: 'Access denied. You can only access your own resources.'
    });
  };
};

/**
 * Middleware to check if user can modify their own profile or admin can modify any
 */
const profileOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Access denied. Authentication required.'
    });
  }

  const targetUserId = req.params.id || req.params.userId;

  // Admin can modify any profile
  if (req.user.role === 'admin') {
    return next();
  }

  // User can only modify their own profile
  if (targetUserId && targetUserId.toString() === req.user._id.toString()) {
    return next();
  }

  return res.status(403).json({
    status: 'error',
    message: 'Access denied. You can only modify your own profile.'
  });
};

/**
 * Middleware to log authorization attempts
 * Useful for security monitoring
 */
const logAuthAttempt = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userId = req.user?._id || 'anonymous';
  const userRole = req.user?.role || 'none';
  const method = req.method;
  const path = req.path;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] AUTH: ${userId} (${userRole}) ${method} ${path} from ${ip}`);
  
  next();
};

module.exports = {
  authorize,
  adminOnly,
  ownerOrAdmin,
  profileOwnerOrAdmin,
  logAuthAttempt
};