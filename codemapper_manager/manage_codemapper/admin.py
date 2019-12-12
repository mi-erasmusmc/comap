import secrets
import string
from django.contrib import admin

import codemapper
from .models import User, Project, Member, Mapping


class MappingInline(admin.TabularInline):
    model = Mapping
    extra = 0


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


class UserAdmin(admin.ModelAdmin):

    def reset_password(self, request, queryset):
        plain, password = self.generate_password()
        rows_updated = queryset.update(password=password)
        self.message_user(request, "Password was reset for {} user(s) to: {}".format(rows_updated, plain))

    def generate_password(self):
        alphabet = string.ascii_letters + string.digits
        plain = ''.join(secrets.choice(alphabet) for i in range(20))
        return plain, codemapper.sha256(plain)

    reset_password.short_description = "Reset password of selected users"

    inlines = (MemberInline,)
    actions = ['reset_password']

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ["username", "password"]
        else:
            return []


admin.site.register(User, UserAdmin)
admin.site.register(Project, ProjectAdmin)
# admin.site.register(Member, MemberAdmin)
# admin.site.register(Mapping, MappingAdmin)
admin.site.site_header = "CodeMapper administation"
# admin.site.site_title = ""
admin.site.index_title = "Welcome to the CodeMapper administration"
