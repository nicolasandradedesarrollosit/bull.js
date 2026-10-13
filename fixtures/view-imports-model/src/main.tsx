import { createBullApp } from "@bull-js/runtime/react";
import { UserListView } from "./view/user-list.view";

createBullApp({ root: UserListView });
