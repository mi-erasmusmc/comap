import string
import secrets

from django import http, forms, urls
from django.contrib import admin, messages
import django.contrib.auth.admin as auth_admin
import django.contrib.auth.models as auth_models
from django.shortcuts import get_object_or_404

from .models import User, Project, Member, Mapping
import codemapper


class MyAdminSite(admin.AdminSite):

    site_header = "CodeMapper administration"
    site_title = "CodeMapper administration"
    index_title = "Welcome to the CodeMapper administration"

    def generate_password(self):
        # The XKCD style
        with open('/usr/share/dict/words', encoding='utf-8') as f:
            words = [word.strip() for word in f if word.strip().isalpha()]
        return ' '.join(secrets.choice(words) for i in range(4))

    def reset_password(self, request, user_id):
        if request.method == 'POST':
            user = get_object_or_404(User, pk=user_id)
            password = self.generate_password()
            user.password = codemapper.sha256(password)
            user.save()
            messages.add_message(request, messages.INFO, "Password of user {} was changed to: {}".format(user.username, password))
            return http.HttpResponseRedirect(urls.reverse("admin:{}_{}_change".format(user._meta.app_label, user._meta.model_name), args=(user_id,)))

    def get_urls(self):
        res = super(MyAdminSite, self).get_urls()
        res += [
            urls.path(r'reset_password/<user_id>', self.admin_view(self.reset_password), name='reset_password')
        ]
        return res

admin_site = MyAdminSite()
admin_site.register(auth_models.User, auth_admin.UserAdmin)

class MappingInline(admin.TabularInline):

    model = Mapping
    extra = 0

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["name"]
        else:
            return []

    def has_add_permission(self, request, obj=None):
        return False


class MemberInline(admin.TabularInline):

    model = Member
    extra = 3


class MemberAdmin(admin.ModelAdmin):

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["user", "project"]
        else:
            return []


class MappingAdmin(admin.ModelAdmin):

    def has_add_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["name", "state"]
        else:
            return []


@admin.register(Project, site=admin_site)
class ProjectAdmin(admin.ModelAdmin):

    inlines = (MemberInline, MappingInline,)

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["name"]
        else:
            return []

class UserForm(forms.ModelForm):

    def clean_password(self):
        value = self.cleaned_data['password']
        print('Password:', value)
        return codemapper.sha256(value)


@admin.register(User, site=admin_site)
class UserAdmin(admin.ModelAdmin):

    form = UserForm
    inlines = (MemberInline,)
    change_form_template = 'admin/change_user.html'

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["username"]
        else:
            return []

    def get_exclude(self, request, obj=None):
        if obj:
            return ["password"]
        else:
            return []

