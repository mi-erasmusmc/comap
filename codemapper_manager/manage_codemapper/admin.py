import secrets
import string
from django.contrib import admin, messages
from django import forms

import codemapper
from .models import User, Project, Member, Mapping


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


class UserAdmin(admin.ModelAdmin):

    form = UserForm

    def generate_password(self):
        # The XKCD style
        with open('/usr/share/dict/words') as f:
            words = [word.strip() for word in f if word.strip().isalpha()]
        return ' '.join(secrets.choice(words) for i in range(4))

    def reset_password(self, request, queryset):
        if queryset.count() == 0 or queryset.count() > 1:
            self.message_user(request, "Password can only be reset for a single user", level=messages.ERROR)
        else:
            password = self.generate_password()
            hash = codemapper.sha256(password)
            rows_updated = queryset.update(password=hash)
            names = ', '.join(u.username for u in queryset)
            self.message_user(request, "Password of user{} {} was changed to: {}".format('' if queryset.count() == 1 else 's', names, password))

    reset_password.short_description = "Reset password of one users"

    inlines = (MemberInline,)
    actions = ['reset_password']

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


admin.site.register(User, UserAdmin)
admin.site.register(Project, ProjectAdmin)
# admin.site.register(Member, MemberAdmin)
# admin.site.register(Mapping, MappingAdmin)
admin.site.site_header = "CodeMapper administation"
# admin.site.site_title = ""
admin.site.index_title = "Welcome to the CodeMapper administration"
