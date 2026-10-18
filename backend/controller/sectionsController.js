import Section from "../models/catalogue/Section.js";

// READ sections available for a particular course code
// GET /api/bidding/sections
export const readSection = async (req, res) => {
  try {
    const { moduleCode } = req.query;
    const filter = moduleCode ? { moduleCode } : {};
    const sections = await Section.find(filter);

    res.status(200).json(sections);
  } catch (error) {
    console.error("Error in readSection", error);
    return res.status(500).json({ message: "Failed to read sections" });
  }
};

// POST/api/bidding/validate-cart
export const validateCartClashes = async (req, res) => {
  try {
    const { sectionIds } = req.body;
    if (!Array.isArray(sectionIds)) {
      return res.status(400).json({ message: "sectionIds must be an array" });
    }
    const uniqueIds = [...new Set(sectionIds)]; // Remove duplicates
    const sections = await Section.find({ _id: { $in: uniqueIds } });

    if (sections.length !== uniqueIds.length) {
      return res.status(400).json({ message: "Some sections not found" });
    }
    // sections from different terms can't be in the same cart
    const termKeys = new Set(sections.map((s) => s.termKey));
    if (termKeys.size > 1) {
      return res.status(400).json({ message: "All sections must be in the same term" });
    }

    const clashes = [];

    // helper function
    // function to change the schema time of HH:MM into minutes for easy comparison
    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };

    const slotsClash = (x, y) => {
      return (
        x.day === y.day &&
        toMinutes(x.start) < toMinutes(y.end) &&
        toMinutes(y.start) < toMinutes(x.end)
      );
    };

    const finalExamClash = (x, y) => {
      // this checks that the module has a final exam and a valid date
      if (x.finalExam === null || y.finalExam === null) return false;
        return (
          x.finalExam.date.toDateString() === y.finalExam.date.toDateString() &&
          toMinutes(x.finalExam.start) < toMinutes(y.finalExam.end) &&
          toMinutes(y.finalExam.start) < toMinutes(x.finalExam.end)
        );
    };

    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const a = sections[i];
        const b = sections[j];


        if (a.moduleCode === b.moduleCode) {
          clashes.push({
            type: "duplicate-module",
            a: {
              _id: a._id,
              sectionCode: a.sectionCode,
              moduleCode: a.moduleCode,
            },
            b: {
              _id: b._id,
              sectionCode: b.sectionCode,
              moduleCode: b.moduleCode,
            },
            // details that the UI needs, but not entirely sure what details front end need
          });
        }

        // in case of time clash: loop through every slot of a and every slot of b
        // check for duplicate and non-duplicate mods timetable clash
        for (const slotA of a.classSlots) {
          for (const slotB of b.classSlots) {
            if (slotsClash(slotA, slotB)) {
              clashes.push({
                type: "time", // what kind of conflict this is
                a: {
                  _id: a._id,
                  sectionCode: a.sectionCode,
                  moduleCode: a.moduleCode,
                },
                b: {
                  _id: b._id,
                  sectionCode: b.sectionCode,
                  moduleCode: b.moduleCode,
                },
                day: slotA.day, // the detail the UI needs
              });
            }
          }
        }

        // exam: only if both a.finalExam and b.finalExam are non-null
        if (a.finalExam?.date && b.finalExam?.date) {
          if (finalExamClash(a, b)) {
            clashes.push({
              type: "final-exam-clash",
              a: {
                _id: a._id,
                sectionCode: a.sectionCode,
                moduleCode: a.moduleCode,
              },
              b: {
                _id: b._id,
                sectionCode: b.sectionCode,
                moduleCode: b.moduleCode,
              },
              finalExam: a.finalExam.date,
            });
          }
        }
      }
    }
    res.status(200).json({ valid: clashes.length === 0, clashes });
  } catch (error) {
    console.error("Error in validateCartClash", error);
    res.status(500).json({ message: "Failed to validate cart" });
  }
};
