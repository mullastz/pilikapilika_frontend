import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-manage-account',
  imports: [],
  templateUrl: './manage-account.html',
  styleUrl: './manage-account.css',
})
export class ManageAccount {

  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
