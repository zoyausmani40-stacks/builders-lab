export function canViewIssue(issue, user) {
  if (['admin','officer'].includes(user.role)) return true;
  if (user.role === 'worker') return String(issue.assignedTo?._id || issue.assignedTo || '') === String(user._id);
  return String(issue.citizen?._id || issue.citizen || '') === String(user._id);
}
