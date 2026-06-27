from django.db import models


class Resume(models.Model):
    # Column names match the existing DB schema exactly (mixed case)
    ID = models.IntegerField(primary_key=True)
    Resume_str = models.TextField()
    Resume_html = models.TextField()
    Category = models.CharField(max_length=100)
    # embedding vector(384) is accessed only via raw SQL

    class Meta:
        managed = False
        db_table = "resume"


class Posting(models.Model):
    job_id = models.IntegerField(primary_key=True)
    company_name = models.CharField(max_length=300)
    title = models.CharField(max_length=300)
    description = models.TextField()
    location = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        managed = False
        db_table = "postings"
