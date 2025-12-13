// Role-based authorization middleware

// User roles enum
const ROLES = {
  USER: 'user',
  RESPONDER: 'responder',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

// Role hierarchy (higher index = more permissions)
const ROLE_HIERARCHY = [ROLES.USER, ROLES.RESPONDER, ROLES.ADMIN, ROLES.SUPER_ADMIN];

/**
 * Check if user has one of the allowed roles
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Check if user has at least the minimum required role level
 * @param {string} minRole - Minimum role required
 */
const authorizeMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

    if (userRoleIndex < requiredRoleIndex) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Minimum required role: ${minRole}`,
      });
    }

    next();
  };
};

/**
 * Check if user is the owner of the resource or has admin privileges
 * @param {Function} getResourceOwnerId - Function to get owner ID from request
 */
const authorizeOwnerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    try {
      const ownerId = await getResourceOwnerId(req);

      // Check if user is owner or admin
      const isOwner = ownerId && req.user._id.toString() === ownerId.toString();
      const isAdmin = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to access this resource.',
        });
      }

      req.isOwner = isOwner;
      req.isAdmin = isAdmin;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
      });
    }
  };
};

/**
 * Middleware to check if user is verified
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your account to access this feature',
    });
  }

  next();
};

/**
 * Middleware to check specific permissions
 * @param {string} permission - Permission to check
 */
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Super admin has all permissions
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    // Check if user has the specific permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
      });
    }

    next();
  };
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  authorize,
  authorizeMinRole,
  authorizeOwnerOrAdmin,
  requireVerified,
  checkPermission,
};
