export interface User {
  id: number;
  name: string;
}

export class UserRepository {
  async list(): Promise<User[]> {
    return (await fetch("/api/users")).json();
  }
}
