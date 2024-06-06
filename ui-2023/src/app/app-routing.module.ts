import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WelcomeViewComponent } from './mapping/welcome-view/welcome-view.component';
import { MappingViewComponent } from './mapping/mapping-view/mapping-view.component';
import { ProjectsViewComponent } from './mapping/projects-view/projects-view.component';
import { EventsViewComponent } from './mapping/events-view/events-view.component';
import { NewsViewComponent } from './mapping/news-view/news-view.component';
import { AuthGuard, NoAuthGuard } from './mapping/auth.guard';
import { PendingChangesGuard } from './mapping/pending-changes.guard';

const routes : Routes = [
  {
    path: "",
    title: () => Promise.resolve("CodeMapper: Welcome"),
    component: WelcomeViewComponent,
  },
  {
    path: "news",
    title: () => Promise.resolve("CodeMapper: News"),
    component: NewsViewComponent,
  },
  {
    path: "projects",
    title: () => Promise.resolve("CodeMapper: Projects"),
    canActivate: [AuthGuard],
    component: ProjectsViewComponent,
  },
  {
    path: "project/:project",
    canActivate: [AuthGuard],
    component: EventsViewComponent,
  },
  {
    path: "project/:project/event/:mapping",
    canActivate: [AuthGuard],
    canDeactivate: [PendingChangesGuard],
    component: MappingViewComponent,
  },
  { path: '**', redirectTo: '/', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
