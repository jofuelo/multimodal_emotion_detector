from django.urls import path
from django.conf.urls import url
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    url(r'^ajax/analyze_audio/$', views.analyze_audio, name='analyze_audio'),
] 
