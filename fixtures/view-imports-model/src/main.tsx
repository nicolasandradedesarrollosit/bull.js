import { createBullApp } from "@bull/runtime/react";
import { UserListView } from "./view/user-list.view";

createBullApp({ root: UserListView });
