import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../auth.service';

@Component({
  selector: 'app-loggedin',
  templateUrl: './loggedin.component.html',
  styleUrls: ['./loggedin.component.scss']
})
export class LoggedinComponent {
  user : User | null = null;
  constructor(private auth : AuthService, public router : Router) {
    this.auth.userSubject.subscribe((user) => this.user = user);
  }
  logout() {
    if (confirm("Really want to logout?")) {
      this.auth.logout()
        .subscribe(() => {
          this.router.navigate(['login']);
        });
    }
  }
}
