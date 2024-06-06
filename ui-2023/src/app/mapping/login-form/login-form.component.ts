import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, LoginResult } from '../auth.service';
import { FormControl } from "@angular/forms";
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
})
export class LoginFormComponent {
  hide : boolean = true;
  error : string = "";
  username = new FormControl("");
  password = new FormControl("");

  constructor(
    private auth : AuthService,
    private snackBar : MatSnackBar,
    public router : Router,
  ) { }

  login() {
    let username = this.username.getRawValue();
    let password = this.password.getRawValue();
    if (username && password) {
      this.auth.login(username, password)
        .subscribe((res) => {
          console.log("form login res", res);
          if (res.success) {
            if (res.redirectUrl) {
              this.router.navigate([res.redirectUrl]);
            } else {
              this.router.navigate(['projects']);
            }
          } else {
            this.error = res.error!;
          }
        });
    }
  }
}
