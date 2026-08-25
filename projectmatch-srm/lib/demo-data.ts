export type DemoPerson = { id?: string; isCurrent?: boolean; name: string; handle: string; branch: string; year: string; skills: string[]; availableDays: number[]; freshness: string; bio: string };
export type DemoProject = { id: string; title: string; type: string; timezone: string; commitment: string; roles: number; categories: string[]; description: string; openRoles: string[]; ownerId?: string; ownerName?: string; institution?: string; createdAtMs?: number };

export const campusName = "SRM Institute of Science and Technology, Kattankulathur";
export const campusShortName = "SRM University";

export const studentInterests = ["AI & Machine Learning", "Climate Tech", "Healthtech", "Fintech", "Robotics", "EdTech", "Game Development", "Cybersecurity", "Social Impact", "Research", "Entrepreneurship", "Open Source"] as const;

export const engineeringStreams = [
  ["CSE", "Computer Science / IT"], ["ECE", "Electronics & Communication"],
  ["EEE", "Electrical Engineering"], ["MECH", "Mechanical Engineering"],
  ["CIVIL", "Civil Engineering"], ["CHEMICAL", "Chemical Engineering"],
  ["BIOTECH", "Biotechnology / Biomedical"], ["AEROSPACE", "Aerospace Engineering"],
  ["OTHER", "Cross-disciplinary / Other"],
] as const;

export const people: DemoPerson[] = [
  { name: "Priya Nair", handle: "priya-nair", branch: "CSE", year: "3rd Year", skills: ["React", "Next.js", "UI/UX"], availableDays: [0,1,2,4,5], freshness: "synced 3 hours ago", bio: "Frontend builder who loves turning complex ideas into clear product experiences." },
  { name: "Arjun Mehta", handle: "arjun-mehta", branch: "ECE", year: "3rd Year", skills: ["IoT", "Embedded Systems", "Python"], availableDays: [1,2,3,5], freshness: "manually set 2 days ago", bio: "ECE student building practical connected devices." },
  { name: "Aisha Khan", handle: "aisha-khan", branch: "CSE", year: "2nd Year", skills: ["Data Science", "Python", "Pandas"], availableDays: [0,2,3,4], freshness: "synced yesterday", bio: "Data explorer looking for meaningful climate and health projects." },
  { name: "Rohan Iyer", handle: "rohan-iyer", branch: "MECH", year: "4th Year", skills: ["CAD/CAM", "Robotics", "Manufacturing"], availableDays: [1,3,4,6], freshness: "manually set 1 week ago", bio: "Mechanical engineer with a robotics prototype habit." },
  { name: "Meera Das", handle: "meera-das", branch: "BIOTECH", year: "1st Year", skills: ["Bioinformatics", "Data Analysis", "Research"], availableDays: [0,1,4,5], freshness: "synced 5 hours ago", bio: "Curious biotech learner excited by collaborative research." },
  { name: "Vikram Rao", handle: "vikram-rao", branch: "EEE", year: "4th Year", skills: ["Renewable Energy", "Control Systems", "IoT"], availableDays: [2,3,4,5], freshness: "manually set 3 days ago", bio: "Power systems enthusiast pursuing clean-energy prototypes." },
  { name: "Kavya Menon", handle: "kavya-menon", branch: "CIVIL", year: "2nd Year", skills: ["Structural Design", "Environmental Engineering", "CAD"], availableDays: [0,2,5], freshness: "synced 6 hours ago", bio: "Civil engineering student focused on sustainable public infrastructure." },
  { name: "Daniel Joseph", handle: "daniel-joseph", branch: "CHEMICAL", year: "3rd Year", skills: ["Process Engineering", "Materials Science", "Data Analysis"], availableDays: [1,3,5,6], freshness: "manually set yesterday", bio: "Process engineering student interested in cleaner industrial systems." },
  { name: "Sara Ahmed", handle: "sara-ahmed", branch: "AEROSPACE", year: "4th Year", skills: ["Aerodynamics", "Avionics", "Python"], availableDays: [0,1,3,4], freshness: "synced 2 hours ago", bio: "Aerospace builder exploring flight systems and simulation." },
  { name: "Neel Shah", handle: "neel-shah", branch: "OTHER", year: "1st Year", skills: ["Product Management", "Technical Writing", "Business & Marketing"], availableDays: [2,4,6], freshness: "manually set today", bio: "Cross-disciplinary organizer who helps technical teams ship clearly." },
];
export const projects: DemoProject[] = [
  { id: "campus-carbon-map", title: "Campus Carbon Map", type: "Hackathon", timezone: "Asia/Kolkata", commitment: "8 hrs/week", roles: 3, categories: ["Data Science", "UI/UX Design", "Web Development"], description: "Turn campus energy data into actions students can take.", openRoles: ["Data Scientist", "Product Designer", "Frontend Developer"] },
  { id: "mindful-study-companion", title: "Mindful Study Companion", type: "Startup", timezone: "Asia/Kolkata", commitment: "10 hrs/week", roles: 2, categories: ["Mobile App Development", "Product Management", "AI/ML"], description: "A supportive planning companion for study teams.", openRoles: ["Mobile Developer", "ML Engineer"] },
  { id: "smart-irrigation-lab", title: "Smart Irrigation Lab", type: "Research", timezone: "Asia/Kolkata", commitment: "6 hrs/week", roles: 2, categories: ["IoT", "Embedded Systems", "Data Analysis"], description: "Field-ready sensors for water-efficient growing.", openRoles: ["Embedded Engineer", "Data Analyst"] },
  { id: "accessible-transit", title: "Accessible Transit", type: "Coursework", timezone: "Asia/Kolkata", commitment: "5 hrs/week", roles: 1, categories: ["UI/UX Design", "Web Development"], description: "An inclusive route-planning prototype for local transport.", openRoles: ["Accessibility Designer"] },
];
