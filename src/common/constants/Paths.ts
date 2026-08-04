export default {
  Base: "/api",
  Users: {
    Base: "/users",
    Get: "/all",
    Add: "/add",
    Update: "/update",
    Delete: "/delete/:id",
  },
  Posts: {
    Base: "/posts",
  },
  Reviews: {
    Base: "/reviews",
  },
  Upload: {
    Base: "/upload",
  },
  Chat: {
    Base: "/chat",
  },
  Notifications: {
    Base: "/notifications",
  },
  Notices: {
    Base: "/notices",
  },
  PickupZones: {
    Base: "/pickup-zones",
  },
  Faqs: {
    Base: "/faqs",
  },
  EmailVerifications: {
    Base: "/auth/email-verifications",
  },
} as const;
