// Keep the catalogue JSON-compatible: the static page renderer reads this data
// without executing JavaScript. Both hubs work before any browser script runs.
export const catalogue = [
  {
    "id": "femur",
    "title": "Femur",
    "explore": "mesh-spike.html",
    "lesson": "femur-lesson.html",
    "exploreDescription": "Move the beam around the femur and compare the images. Switch between cortex + core and a uniform appearance. This view shows the bone without a wire.",
    "lessonDescription": "Take AP and lateral views of the wire. Decide whether its position meets the criteria and explain why, then check it in 3D."
  },
  {
    "id": "fundamentals",
    "title": "Projection fundamentals",
    "explore": "beam3d.html",
    "lesson": "guided.html",
    "exploreDescription": "Move the beam around a cylinder and wire, save an image for comparison and look around in 3D.",
    "lessonDescription": "Work through three wire-position challenges. Choose another view and give your answer before revealing the wire."
  }
];
