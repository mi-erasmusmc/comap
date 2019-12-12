from django.db import models


class User(models.Model):

    username = models.CharField(max_length=100)
    password = models.CharField(max_length=64)
    email = models.TextField()

    def __str__(self):
        return self.username

    class Meta:
        ordering = ['username']
        db_table = '"code-mapper"."users"'


class Project(models.Model):

    name = models.CharField(max_length=100)
    users = models.ManyToManyField(User, through='Member', related_name='projects')

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']
        db_table = '"code-mapper"."projects"'


class Member(models.Model):

    user = models.ForeignKey(User, db_column='user_id', on_delete=models.CASCADE)
    project = models.ForeignKey(Project, db_column='project_id', on_delete=models.CASCADE)
    role = models.CharField(max_length=1, choices=[('E', 'Editor'), ['C', 'Commentor']], default='E')

    def __str__(self):
        return "{} - {}".format(self.project.name, self.user.username)

    class Meta:
        db_table = '"code-mapper"."users_projects"'
        unique_together = (("user", "project"),)
        ordering = ['project', 'user']


class Mapping(models.Model):

    project = models.ForeignKey(Project, db_column='project_id', on_delete=models.CASCADE, related_name='mappings')
    name = models.CharField(max_length=255)
    state = models.TextField(editable=False)

    def __str__(self):
        return "{} ({})".format(self.name, self.project.name)

    class Meta:
        db_table = '"code-mapper"."case_definitions"'
        ordering = ['project', 'name']
