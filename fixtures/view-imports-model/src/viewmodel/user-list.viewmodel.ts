import { ViewModel } from "@triad/runtime";
import { UserRepository, type User } from "../model/user.repository";

export class UserListViewModel extends ViewModel {
  users = this.state<User[]>([]);
  readonly #repo = new UserRepository();

  readonly load = this.command(async () => {
    this.users.set(await this.#repo.list());
    document.title = `${this.users.value.length} users`;
  });
}
