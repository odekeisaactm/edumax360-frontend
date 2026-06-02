export const dummySettings = {
  primary_color: '#2c5f8d',
  secondary_color: '#f9fafb',
  header_color: '#2c5f8d',
  accent_color: '#1890ff',
  show_end_of_term_graph: true,
  behavior_max_rating: 5,
};

export const dummySchool = {
  name: "Daises Academy",
  motto: "Knowledge is Power",
  address: "123 Education Way, Learning City",
  email: "info@daisesacademy.com.ng",
  mobile: "+234 800 000 0000",
  website: "www.daisesacademy.com.ng",
  logo: "https://via.placeholder.com/150",
};

export const dummyStudent = {
  name: "John Doe",
  admissionId: "DA/2024/001",
  class: "JSS 1 A",
  noInClass: 35,
  gender: "Male",
  attendance: "95",
  daysOpened: "100",
  termClosed: "15 Dec 2024",
  nextTermOpens: "10 Jan 2025",
  image: "https://via.placeholder.com/150",
  term: "First Term 2024/2025 Session",
};

export const dummyScoreResult = {
  fields: [
    { key: "assignment", label: "Assignment", max: 10 },
    { key: "test", label: "Test", max: 20 },
    { key: "project", label: "Project", max: 10 },
    { key: "exam", label: "Exam", max: 60 },
  ],
  subjects: [
    { name: "Mathematics", assignment: 8, test: 15, project: 9, exam: 50, total: 82, highest: 95, lowest: 40, avg: 72, pos: "3rd", grade: "A", remark: "Excellent" },
    { name: "English Language", assignment: 9, test: 18, project: 8, exam: 45, total: 80, highest: 90, lowest: 45, avg: 68, pos: "5th", grade: "A", remark: "Excellent" },
    { name: "Basic Science", assignment: 7, test: 12, project: 7, exam: 35, total: 61, highest: 85, lowest: 30, avg: 60, pos: "12th", grade: "C", remark: "Good" },
    { name: "Social Studies", assignment: 6, test: 14, project: 8, exam: 40, total: 68, highest: 88, lowest: 35, avg: 65, pos: "8th", grade: "B", remark: "Very Good" },
    { name: "Civic Education", assignment: 8, test: 16, project: 9, exam: 55, total: 88, highest: 92, lowest: 50, avg: 75, pos: "1st", grade: "A", remark: "Excellent" },
  ],
  summary: {
    totalScore: 379,
    studentAverage: 75.8,
    classAverage: 68.5,
  }
};

export const dummyTextResult = {
  categories: [
    {
      name: "Cognitive Domain",
      fields: [
        { name: "Reading Aloud", score: "Excellent" },
        { name: "Writing Skills", score: "Good" },
        { name: "Spelling", score: "Very Good" },
        { name: "Number Work", score: "Excellent" },
      ]
    },
    {
      name: "Psychomotor Domain",
      fields: [
        { name: "Handwriting", score: "Good" },
        { name: "Drawing / Painting", score: "Excellent" },
        { name: "Crafts", score: "Very Good" },
        { name: "Sports / Games", score: "Excellent" },
      ]
    }
  ]
};

export const dummyBehavior = {
  categories: [
    {
      name: "Affective Traits",
      items: [
        { name: "Punctuality", score: 5 },
        { name: "Neatness", score: 4 },
        { name: "Politeness", score: 5 },
        { name: "Honesty", score: 4 },
      ]
    },
    {
      name: "Social Traits",
      items: [
        { name: "Relationship with Peers", score: 5 },
        { name: "Leadership Skills", score: 4 },
        { name: "Self Control", score: 5 },
        { name: "Attentiveness", score: 5 },
      ]
    }
  ]
};

export const dummyComments = {
  areaOfFocus: "Mathematics and Science",
  teacherName: "Mr. Smith",
  teacherComment: "John is a brilliant student. Keep it up!",
  principalName: "Dr. Adams",
  principalComment: "An outstanding performance. Congratulations!"
};