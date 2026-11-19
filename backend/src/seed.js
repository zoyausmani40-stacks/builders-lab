import 'dotenv/config';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Issue from './models/Issue.js';

await connectDB();
const demo = [
  { name:'CivicGrid Admin', email:'admin@civicgrid.local', password:'Admin@123', role:'admin', department:'Administration' },
  { name:'Demo Officer', email:'officer@civicgrid.local', password:'Officer@123', role:'officer', department:'Municipal Services' },
  { name:'Demo Field Worker', email:'worker@civicgrid.local', password:'Worker@123', role:'worker', department:'Roads' },
  { name:'Demo Citizen', email:'citizen@civicgrid.local', password:'Citizen@123', role:'citizen', department:'General' }
];
const users = {};
for (const item of demo) {
  let user = await User.findOne({ email: item.email }).select('+password');
  if (!user) user = await User.create(item);
  else { Object.assign(user, item); await user.save(); }
  users[item.role] = user;
}
if (await Issue.countDocuments() === 0) {
  await Issue.create([
    { title:'Large pothole near market road', description:'A deep pothole is causing traffic issues. Please repair it.', category:'Roads', priority:'high', status:'submitted', address:'Market Road, Mathura', location:{type:'Point',coordinates:[77.6737,27.4924]}, citizen:users.citizen._id, timeline:[{status:'submitted',message:'Complaint submitted by citizen',by:users.citizen._id}] },
    { title:'Streetlight not working', description:'Streetlight has been off for three nights.', category:'Streetlight', priority:'medium', status:'assigned', address:'Civil Lines, Mathura', location:{type:'Point',coordinates:[77.681,27.501]}, citizen:users.citizen._id, assignedTo:users.worker._id, timeline:[{status:'submitted',message:'Complaint submitted by citizen',by:users.citizen._id},{status:'assigned',message:'Assigned to Demo Field Worker',by:users.officer._id}] }
  ]);
}
console.log('Seed complete. Demo accounts created/updated.');
await (await import('mongoose')).default.disconnect();
