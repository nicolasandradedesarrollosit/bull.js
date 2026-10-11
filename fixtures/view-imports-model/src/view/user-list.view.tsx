import { useEffect, useState } from "react";
import { UserRepository, type User } from "../model/user.repository";

export function UserListView() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    new UserRepository().list().then(setUsers);
  }, []);

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
