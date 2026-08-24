export type Role="student"|"volunteer"|"doctor";
export interface Profile { uid:string; email:string|null; displayName:string|null; photoURL:string|null; role:Role|null; }

