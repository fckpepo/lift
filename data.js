/* LIFT — language-neutral plan structure. Copy lives in i18n.js. */
window.LIFT_DATA = {
  profile: {
    name: "Pedro",
    weightKg: 61,
    heightCm: 163,
    bfPct: 12,
    age: 28,
    vo2: 48.5,
    vo2Target: 52,
    hrMax: 192,
    z2: [125, 134],
  },

  weekdays: [
    { dow: 1, key: "upper-a" },
    { dow: 2, key: "lower-a" },
    { dow: 3, key: "z2" },
    { dow: 4, key: "upper-b" },
    { dow: 5, key: "lower-b" },
  ],

  sessions: {
    "upper-a": {
      key: "upper-a",
      tag: "horizontal",
      kind: "lift",
      minutes: 45,
      exercises: [
        { num: "A1", sets: 3, reps: "6–10", rest: "2–3 min", rpe: "7–8" },
        { num: "B1", sets: 3, reps: "6–10", rest: "2–3 min", rpe: "7–8" },
        { num: "C1", sets: 3, reps: "8–12", rest: "2 min", rpe: "8" },
        { num: "D1", sets: 3, reps: "8–12", rest: "90s–2 min", rpe: "8" },
        { num: "E1", sets: 3, reps: "12–20", rest: "60s", rpe: "8" },
        { num: "F1", sets: 2, reps: "10–15", rest: "60s", rpe: "8–9" },
      ],
    },
    "lower-a": {
      key: "lower-a",
      tag: "quad",
      kind: "lift",
      minutes: 45,
      exercises: [
        { num: "A1", sets: 4, reps: "8–12", rest: "3 min", rpe: "7–8", knee: true },
        { num: "B1", sets: 3, reps: "10–15", rest: "2 min", rpe: "7–8", knee: true },
        { num: "C1", sets: 3, reps: "10–15", rest: "90s", rpe: "8–9", knee: true },
        { num: "D1", sets: 2, reps: "10–15", rest: "90s", rpe: "8–9" },
        { num: "E1", sets: 3, reps: "10–20", rest: "60s", rpe: "8" },
      ],
    },
    z2: {
      key: "z2",
      tag: "cardio",
      kind: "cardio",
      minutes: 45,
      exercises: [],
    },
    "upper-b": {
      key: "upper-b",
      tag: "vertical",
      kind: "lift",
      minutes: 45,
      exercises: [
        { num: "A1", sets: 3, reps: "5–8", rest: "2–3 min", rpe: "7–8" },
        { num: "B1", sets: 3, reps: "8–12", rest: "2 min", rpe: "8" },
        { num: "C1", sets: 3, reps: "10–15", rest: "90s", rpe: "8–9" },
        { num: "D1", sets: 2, reps: "15–20", rest: "60s", rpe: "7" },
        { num: "E1", sets: 3, reps: "12–20", rest: "60s", rpe: "8" },
        { num: "F1", sets: 3, reps: "8–12", rest: "90s", rpe: "8–9" },
        { num: "G1", sets: 2, reps: "10–15", rest: "75s", rpe: "8" },
      ],
    },
    "lower-b": {
      key: "lower-b",
      tag: "posterior",
      kind: "lift",
      minutes: 45,
      exercises: [
        { num: "A1", sets: 4, reps: "8–12", rest: "2–3 min", rpe: "8" },
        { num: "B1", sets: 3, reps: "8–10", rest: "2–3 min", rpe: "7–8" },
        { num: "C1", sets: 3, reps: "10–15", rest: "90s", rpe: "8–9" },
        { num: "D1", sets: 2, reps: "10–15", rest: "90s", rpe: "8" },
        { num: "E1", sets: 3, reps: "12–20", rest: "60s", rpe: "8" },
      ],
    },
  },
};
