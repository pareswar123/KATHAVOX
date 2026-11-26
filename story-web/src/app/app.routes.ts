import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guards';
import { ROUTES } from './core/config/endpoints';
import { translate } from './core/i18n/i18n';
import { LoginComponent } from './features/auth/login.component';
import { SetPasswordComponent } from './features/auth/set-password.component';
import { RegisterChoiceComponent } from './features/auth/register-choice.component';
import { ReaderRegisterComponent } from './features/auth/reader-register.component';
import { AuthorRegisterComponent } from './features/auth/author-register.component';
import { VerifyEmailComponent } from './features/auth/verify-email.component';
import { AdminPaymentsComponent } from './features/admin/payments.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password.component';
import { MyLibraryComponent } from './features/reader/my-library.component';
import { PlaceholderComponent } from './features/placeholder/placeholder.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SubscriptionPlansComponent } from './features/admin/subscription-plans.component';
import { SubscriptionsComponent } from './features/public/subscriptions.component';
import { PortalShellComponent } from './features/portal/portal-shell.component';
import { StoryListComponent } from './features/stories/story-list.component';
import { StoryFormComponent } from './features/stories/story-form.component';
import { StoryPagesComponent } from './features/stories/story-pages.component';
import { ApprovalsComponent } from './features/admin/approvals.component';
import { CatalogueComponent } from './features/admin/catalogue.component';
import { PublicShellComponent } from './features/public/public-shell.component';
import { HomeComponent } from './features/public/home.component';
import { StoryDetailComponent } from './features/public/story-detail.component';
import { StoryReaderComponent } from './features/public/story-reader.component';
import { Portal } from './core/models/story.model';

/** Strips the leading slash, because Angular route paths are relative. */
const path = (route: string): string => route.replace(/^\//, '');

/** Child routes for a portal. Each child carries the portal in its data, so shared screens know their API prefix. */
function portalRoutes(portal: Portal, children: Routes): Routes {
  return children.map((route) => ({ ...route, data: { ...route.data, portal } }));
}

const authorChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent, title: () => translate('pageTitles.authorDashboard') },
  { path: 'stories', component: StoryListComponent, title: () => translate('pageTitles.authorStories') },
  { path: 'stories/create', component: StoryFormComponent },
  { path: 'stories/:id/edit', component: StoryFormComponent },
  { path: 'stories/:id/pages', component: StoryPagesComponent },
];

const adminChildren: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent, title: () => translate('pageTitles.adminDashboard') },
  { path: 'stories', component: StoryListComponent, title: () => translate('pageTitles.adminStories') },
  { path: 'stories/create', component: StoryFormComponent },
  { path: 'stories/:id/edit', component: StoryFormComponent },
  { path: 'stories/:id/pages', component: StoryPagesComponent },
  // { path: 'approvals', component: ApprovalsComponent, title: () => translate('pageTitles.approvals') },
  { path: 'catalogue', component: CatalogueComponent, title: () => translate('pageTitles.catalogue') },
  { path: 'subscription-plans', component: SubscriptionPlansComponent, title: () => translate('subscriptions.admin.title') },
  { path: 'payments', component: AdminPaymentsComponent, title: () => translate('payments.title') },
  { path: 'books', loadComponent: () => import('./features/books/admin-books-list.component').then((m) => m.AdminBooksListComponent), title: () => translate('books.admin.title') },
  { path: 'books/create', loadComponent: () => import('./features/books/admin-book-form.component').then((m) => m.AdminBookFormComponent), title: () => translate('books.admin.createTitle') },
  { path: 'books/:id/edit', loadComponent: () => import('./features/books/admin-book-form.component').then((m) => m.AdminBookFormComponent), title: () => translate('books.admin.editTitle') },
];

export const routes: Routes = [
  {
    path: path(ROUTES.login),
    component: LoginComponent,
    data: { floatingTheme: true },
    title: () => translate('pageTitles.login'),
  },
  {
    path: 'auth/register',
    component: RegisterChoiceComponent,
    data: { floatingTheme: true },
    title: () => translate('auth.register.title'),
  },
  {
    path: 'auth/reader/register',
    component: ReaderRegisterComponent,
    data: { floatingTheme: true },
    title: () => translate('auth.readerRegister.title'),
  },
  {
    path: 'auth/author/register',
    component: AuthorRegisterComponent,
    data: { floatingTheme: true },
    title: () => translate('pageTitles.authorRegister'),
  },
  {
    path: 'auth/verify-email',
    component: VerifyEmailComponent,
    data: { floatingTheme: true },
    title: () => translate('auth.verify.title'),
  },
  {
    path: 'auth/forgot-password',
    component: ForgotPasswordComponent,
    data: { floatingTheme: true },
    title: () => translate('auth.forgot.title'),
  },
  {
    path: 'auth/reset-password',
    component: SetPasswordComponent,
    data: { mode: 'reset', floatingTheme: true },
    title: () => translate('auth.reset.title'),
  },
  {
    path: 'auth/set-password',
    component: SetPasswordComponent,
    data: { floatingTheme: true },
    title: () => translate('auth.setPassword.title'),
  },
  {
    path: 'author',
    component: PortalShellComponent,
    canActivate: [roleGuard('AUTHOR')],
    data: { portal: 'author' },
    children: portalRoutes('author', authorChildren),
  },
  {
    path: 'admin',
    component: PortalShellComponent,
    canActivate: [roleGuard('ADMIN')],
    data: { portal: 'admin' },
    children: portalRoutes('admin', adminChildren),
  },
  // Public site: no login required. Keep these last so protected prefixes match first.
  {
    path: '',
    component: PublicShellComponent,
    children: [
      { path: '', component: HomeComponent, title: () => translate('placeholder.home') },
      { path: 'reader/my-library', component: MyLibraryComponent, canActivate: [authGuard], title: () => translate('pageTitles.library') },
      { path: 'books', loadComponent: () => import('./features/books/public-books.component').then((m) => m.PublicBooksComponent), title: () => translate('books.public.title') },
      { path: 'book/:slug', loadComponent: () => import('./features/books/book-detail.component').then((m) => m.BookDetailComponent) },
      { path: 'subscriptions', component: SubscriptionsComponent, title: () => translate('subscriptions.page.title'), data: { hideSearch: true } },
      { path: 'story/:slug', component: StoryDetailComponent, data: { hideSearch: true } },
      { path: 'story/:slug/page/:page', component: StoryReaderComponent, data: { hideSearch: true } },
    ],
  },
  { path: '**', redirectTo: '' },
];
