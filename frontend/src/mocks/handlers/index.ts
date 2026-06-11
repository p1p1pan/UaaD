import { activityHandlers } from './activities';
import { behaviorHandlers } from './behaviors';
import { enrollmentHandlers } from './enrollments';
import { notificationHandlers } from './notifications';
import { orderHandlers } from './orders';
import { recommendationHandlers } from './recommendations';
import { authHandlers } from './auth';

export const handlers = [
  ...authHandlers,
  ...activityHandlers,
  ...behaviorHandlers,
  ...enrollmentHandlers,
  ...orderHandlers,
  ...recommendationHandlers,
  ...notificationHandlers,
];
