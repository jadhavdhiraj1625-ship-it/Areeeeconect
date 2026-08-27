const Surveyor = require('../models/Surveyor');
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const Taluka = require('../models/Taluka');

/**
 * Get dynamic capacity limit for a Taluka from MongoDB
 */
async function getTalukaMaxCapacity(talukaName) {
  try {
    const cleanTaluka = String(talukaName || '').toLowerCase().trim();
    const talukaDoc = await Taluka.findOne({ name: cleanTaluka });
    if (talukaDoc && typeof talukaDoc.maxCapacity === 'number') {
      return talukaDoc.maxCapacity;
    }
  } catch (e) {}
  return 3;
}

/**
 * Generate next unique Employee ID (e.g. AGR-2026-005)
 */
async function generateNextEmployeeId() {
  const count = await Surveyor.countDocuments();
  let nextNum = count + 1;
  let candidateId = `AGR-2026-${String(nextNum).padStart(3, '0')}`;

  while (await Surveyor.findOne({ employeeId: candidateId })) {
    nextNum++;
    candidateId = `AGR-2026-${String(nextNum).padStart(3, '0')}`;
  }

  return candidateId;
}

/**
 * Counts active surveyors in a Taluka (available + assigned + busy)
 */
async function getActiveSurveyorCount(talukaName) {
  const cleanTaluka = String(talukaName || '').toLowerCase().trim();
  return await Surveyor.countDocuments({
    taluka: cleanTaluka,
    status: { $in: ['available', 'assigned', 'busy'] }
  });
}

/**
 * Process FIFO waiting queue for a Taluka when a position opens up
 */
async function processTalukaWaitingQueue(talukaName) {
  try {
    const cleanTaluka = String(talukaName || '').toLowerCase().trim();
    if (!cleanTaluka) return;

    const activeCount = await getActiveSurveyorCount(cleanTaluka);
    const maxCap = await getTalukaMaxCapacity(cleanTaluka);

    if (activeCount < maxCap) {
      const slotsAvailable = maxCap - activeCount;

      // Find qualified applicants waiting for this taluka in strict FIFO order
      const waitingCandidates = await Candidate.find({
        preferredTaluka: cleanTaluka,
        applicationStatus: 'waiting'
      })
      .sort({ qualifiedAt: 1, createdAt: 1 })
      .limit(slotsAvailable);

      for (const cand of waitingCandidates) {
        if (!cand.userId) continue;

        const empId = cand.employeeId || await generateNextEmployeeId();

        // 1. Authoritatively elevate user role to surveyor
        await User.findByIdAndUpdate(cand.userId, {
          role: 'surveyor',
          taluka: cleanTaluka
        });

        // 2. Check if surveyor profile exists
        let surveyor = await Surveyor.findOne({ userId: cand.userId });
        const baseNode = cleanTaluka.charAt(0).toUpperCase() + cleanTaluka.slice(1);

        if (!surveyor) {
          surveyor = await Surveyor.create({
            userId: cand.userId,
            employeeId: empId,
            name: cand.fullName,
            baseStation: baseNode,
            taluka: cleanTaluka,
            status: 'available',
            rating: cand.interviewScore ? Math.min(5.0, Math.max(4.0, (cand.interviewScore / 20))) : 5.0,
            jobsCompleted: 0
          });
        } else {
          surveyor.status = 'available';
          surveyor.taluka = cleanTaluka;
          surveyor.baseStation = baseNode;
          surveyor.employeeId = empId;
          await surveyor.save();
        }

        // 3. Update candidate application status to hired
        cand.applicationStatus = 'hired';
        cand.employeeId = empId;
        await cand.save();

        console.log(`✅ [FIFO Queue] Promoted candidate '${cand.fullName}' to active surveyor in taluka '${cleanTaluka}' with ID '${empId}'`);
      }
    }
  } catch (err) {
    console.error('Error processing FIFO waiting queue:', err.message);
  }
}

module.exports = {
  getTalukaMaxCapacity,
  generateNextEmployeeId,
  getActiveSurveyorCount,
  processTalukaWaitingQueue
};
